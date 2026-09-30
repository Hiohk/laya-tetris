import { quoteText } from '@/lib/text'
import type { AppSettings } from './settings'
import type {
  EvalInput,
  EvalResult,
  LayaClientLike,
  LayaRequestBody,
  LayaResponseBody,
  ProbeResult,
} from './types'

class Semaphore {
  private active = 0
  private queue: Array<() => void> = []

  constructor(private readonly limit: () => number) {}

  private acquire(): Promise<void> {
    const max = Math.max(1, this.limit())
    if (this.active < max) {
      this.active += 1
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.active += 1
        resolve()
      })
    })
  }

  private release(): void {
    this.active -= 1
    const next = this.queue.shift()
    if (next) next()
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire()
    return task().finally(() => this.release())
  }
}

function pickNumber(...values: Array<number | undefined>): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

function normalizeError(error: unknown, endpoint?: string): Error {
  if (error instanceof Error) {
    if (error.name === 'AbortError') return new Error('请求被取消或超时')
    // 浏览器把 CORS 拦截、DNS 失败、连接被拒统一报成 TypeError: Failed to fetch，
    // 光看这句无法区分，所以这里按端点是不是绝对地址给出可操作的判断。
    if (error instanceof TypeError && /fetch/i.test(error.message)) {
      if (/^https?:\/\//i.test(endpoint ?? '')) {
        return new Error(
          `请求没到达服务（${endpoint}）：本地 Laya 服务没有 CORS 响应头，浏览器直连会被跨域策略拦截。` +
            '把端点改回相对路径 /v1/systemone 走 Vite 代理即可（Postman 不受同源策略限制，所以那边是通的）',
        )
      }
      return new Error(
        `请求没到达服务（${endpoint}）：确认 npm run dev 在跑，以及模型服务在本机监听、LAYA_TARGET 指向正确`,
      )
    }
    return error
  }
  return new Error(String(error))
}

export class HttpLayaClient implements LayaClientLike {
  readonly kind = 'laya' as const
  private semaphore: Semaphore

  constructor(private readonly getSettings: () => AppSettings) {
    this.semaphore = new Semaphore(() => this.getSettings().concurrency)
  }

  buildBody(input: EvalInput): LayaRequestBody {
    const settings = this.getSettings()
    return {
      model: settings.model,
      state: {
        board: input.context.boardText,
        current_piece: input.context.currentPiece,
        next_pieces: input.context.nextPieces.slice(0, 3),
        candidate_placement: input.description,
        board_metrics: input.candidate.metrics,
      },
      questions: {
        is_good_placement: {
          type: 'noul',
          instructions: settings.instructions,
        },
      },
    }
  }

  private send(body: LayaRequestBody, retriesLeft: number, signal?: AbortSignal): Promise<LayaResponseBody> {
    const settings = this.getSettings()
    const controller = new AbortController()
    let timedOut = false
    const timer = window.setTimeout(() => {
      timedOut = true
      controller.abort(
        new Error(
          `请求超时（${settings.timeoutMs}ms）：本地 Laya 服务是串行推理，` +
            `${settings.candidateCount} 个候选排队会超过这个上限，请在设置 → 决策里调高「单次超时」`,
        ),
      )
    }, settings.timeoutMs)
    const relay = () => controller.abort()
    signal?.addEventListener('abort', relay)

    return fetch(settings.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          return response
            .text()
            .then((text) => Promise.reject(new Error(`HTTP ${response.status} ${response.statusText} ${text.slice(0, 180)}`)))
        }
        return response.json() as Promise<LayaResponseBody>
      })
      .catch((error: unknown) => {
        // 自身超时**不重试**：服务在串行排队，立刻重发只会把新请求塞回队尾，
        // 把队列拉得更长，让后面的候选跟着一起超时（实测会连锁到 6 个候选全灭）。
        // 只对网络抖动类失败重试。
        if (retriesLeft > 0 && !timedOut && !signal?.aborted) return this.send(body, retriesLeft - 1, signal)
        return Promise.reject(normalizeError(error, settings.endpoint))
      })
      .finally(() => {
        window.clearTimeout(timer)
        signal?.removeEventListener('abort', relay)
      })
  }

  async evaluate(input: EvalInput, signal?: AbortSignal): Promise<EvalResult> {
    const body = this.buildBody(input)
    const started = performance.now()
    return this.semaphore.run(() =>
      this.send(body, 1, signal).then((parsed) => {
        const latencyMs = performance.now() - started
        const answer = parsed.answers?.is_good_placement
        const noul = pickNumber(answer?.noul, answer?.confidence, answer?.answer_confidence)
        if (noul === null) {
          return Promise.reject(
            new Error(`响应缺少 answers.is_good_placement.noul：${quoteText(JSON.stringify(parsed).slice(0, 180))}`),
          )
        }
        return {
          noul,
          confidence: pickNumber(answer?.confidence, answer?.answer_confidence) ?? noul,
          inputTokens: pickNumber(parsed.usage?.input_tokens),
          outputTokens: pickNumber(parsed.usage?.output_tokens),
          latencyMs,
          routingReason: parsed.routing?.reason,
          request: body,
          response: parsed,
        }
      }),
    )
  }

  /**
   * 连接自检：**按实际候选数并发打一轮**，而不只是探测端口是否活着。
   *
   * 单发一个请求只能证明「服务在跑」——本地 Laya 是串行推理，单发 0.4s 必然通过，
   * 而真实一局同时要发 N 个候选、排队后最后一个要 N×0.35s。
   * 只测一个请求会让「超时太短」这种真正致命的问题在自检里完全看不出来。
   */
  async probe(): Promise<ProbeResult> {
    const settings = this.getSettings()
    const body: LayaRequestBody = {
      model: settings.model,
      state: {
        board: Array.from({ length: 20 }, () => '..........').join('\n'),
        current_piece: 'T',
        next_pieces: ['I', 'L', 'O'],
        candidate_placement:
          'T 形以「尖朝上」的姿态落在第 4~6 列。落点后：未消除任何行，没有留下空洞；最高堆叠 0 层（共 20 层），相邻列高度差之和为 0，没有深井。优势：不留空洞、表面平整。',
        board_metrics: { lines_cleared: 0, holes: 0, max_height: 0, bumpiness: 0, well_depths: new Array(10).fill(0) },
      },
      questions: { is_good_placement: { type: 'noul', instructions: settings.instructions } },
    }

    const rounds = Math.max(1, Math.min(settings.candidateCount, 8))
    const started = performance.now()
    const settled = await Promise.all(
      Array.from({ length: rounds }, () =>
        this.send(body, 0).then(
          (parsed) => ({ ok: true as const, noul: pickNumber(parsed.answers?.is_good_placement?.noul) }),
          (error: unknown) => ({ ok: false as const, message: normalizeError(error, settings.endpoint).message }),
        ),
      ),
    )
    const latencyMs = performance.now() - started

    const failed = settled.filter((item) => !item.ok)
    if (failed.length > 0) {
      const first = failed[0] as { ok: false; message: string }
      return {
        ok: false,
        latencyMs,
        message: `${rounds} 个并发候选有 ${failed.length} 个失败：${first.message}`,
      }
    }

    const nouls = settled.map((item) => (item as { ok: true; noul: number | null }).noul)
    const noul = nouls.find((value): value is number => value !== null) ?? null
    const slowest = latencyMs / 1000
    return {
      ok: noul !== null,
      latencyMs,
      message:
        noul !== null
          ? `${rounds} 个候选全部返回，最慢 ${slowest.toFixed(2)}s（超时 ${settings.timeoutMs}ms），noul = ${noul.toFixed(4)}`
          : '响应中未找到 noul 字段',
      noul: noul ?? undefined,
    }
  }
}
