import { clamp } from '@/lib/utils'
import type { EvalInput, EvalResult, LayaClientLike } from './types'

/**
 * 离线可跑的概率模拟：不依赖真实模型，用启发式排名加噪声伪造成 noul 概率。
 * 用于开发调试、截图，以及模型未启动时依然能完整演示决策流程。
 */
export class MockLayaClient implements LayaClientLike {
  readonly kind = 'mock' as const

  async evaluate(input: EvalInput): Promise<EvalResult> {
    const started = performance.now()
    const latencyMs = 30 + Math.random() * 140
    await new Promise((resolve) => window.setTimeout(resolve, latencyMs))

    const hint = input.context.rankHint
    const noise = (Math.random() - 0.5) * 0.24
    const noul = clamp(0.34 + hint * 0.58 + noise, 0.01, 0.99)
    const metrics = input.candidate.metrics

    return {
      noul,
      confidence: clamp(noul + (Math.random() - 0.5) * 0.04, 0.01, 0.99),
      inputTokens: 240 + Math.round(input.description.length * 1.6),
      outputTokens: 0,
      latencyMs: performance.now() - started,
      routingReason: `mock：启发式排名 ${(hint * 100).toFixed(0)}%，消除 ${metrics.lines_cleared} 行 / 空洞 ${metrics.holes}`,
      request: {
        model: 'mock-laya',
        state: {
          board: input.context.boardText,
          current_piece: input.context.currentPiece,
          next_pieces: input.context.nextPieces.slice(0, 3),
          candidate_placement: input.description,
          board_metrics: metrics,
        },
        questions: { is_good_placement: { type: 'noul', instructions: '（Mock 模式不发送真实请求）' } },
      },
      response: {
        model: 'mock-laya',
        answers: { is_good_placement: { type: 'noul', noul, confidence: noul, action: { act_probability: 1 } } },
        usage: { input_tokens: 240, output_tokens: 0 },
        routing: { model: 'mock', repo: 'local/mock', reason: 'offline simulation' },
      },
    }
  }
}
