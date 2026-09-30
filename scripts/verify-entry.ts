import { Autopilot } from '../src/ai/autopilot'
import { rankPlacements } from '../src/ai/heuristic'
import { describePlacement } from '../src/ai/describe'
import { enumeratePlacements } from '../src/ai/placement'
import { DEFAULT_SETTINGS } from '../src/ai/settings'
import { boardToText, countFilledCells } from '../src/core/board'
import { COLS, ROWS } from '../src/core/constants'
import { GameEngine } from '../src/core/engine'
import { runtime } from '../src/store/runtime'
import { useGameStore } from '../src/store/useGameStore'

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`✗ ${message}`)
    process.exitCode = 1
  } else {
    console.log(`✓ ${message}`)
  }
}

/**
 * 枚举去重自检：180° 对称的 I / S / Z 转两下之后占的格子完全相同，
 * 如果按矩阵字符串去重就会漏掉，枚举量翻倍、Top-N 候选里同一个落点占两个名额。
 */
function checkNoDuplicatePlacements(): void {
  const engine = new GameEngine(1)
  const board = engine.board
  const problems: string[] = []
  for (const type of ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const) {
    const options = enumeratePlacements(board, type)
    const seen = new Set<string>()
    let dup = 0
    for (const option of options) {
      const key = option.cells.map(([r, c]) => `${r},${c}`).sort().join(' ')
      if (seen.has(key)) dup += 1
      seen.add(key)
    }
    if (dup > 0) problems.push(`${type} 有 ${dup} 个重复落点（${options.length} → ${seen.size}）`)
  }
  assert(problems.length === 0, problems.length === 0 ? '七种方块的落点枚举都没有重复' : problems.join('；'))
}

async function main(): Promise<void> {
  // ---------- 0. 落点枚举去重 ----------
  checkNoDuplicatePlacements()

  // ---------- 1. 引擎 + 落点枚举 + 启发式长跑 ----------
  const engine = new GameEngine(20260930)
  engine.start()

  let rotationsTotal = 0
  for (let i = 0; i < 600; i += 1) {
    const piece = engine.current
    if (!piece || engine.status === 'over') break
    const options = enumeratePlacements(engine.board, piece.type)
    if (options.length === 0) {
      console.error('✗ 出现无合法落点的局面')
      break
    }
    const best = rankPlacements(options)[0]
    let guard = 0
    while (
      engine.current &&
      (engine.current.rotation !== best.rotation || engine.current.x !== best.x) &&
      guard < 24
    ) {
      if (engine.current.rotation !== best.rotation) {
        const clockwise = ((best.rotation - engine.current.rotation) % 4 + 4) % 4
        engine.rotate(clockwise <= 2 ? 1 : -1)
      } else {
        engine.move(Math.sign(best.x - engine.current.x))
      }
      guard += 1
      rotationsTotal += 1
    }
    engine.hardDrop()
  }

  console.log(
    `  启发式长跑结果：落子 ${engine.pieces} 块 / 消行 ${engine.lines} 行 / 得分 ${engine.score} / 状态 ${engine.status}`,
  )
  assert(engine.pieces >= 40, '启发式长跑至少落子 40 块（说明引擎与落点枚举稳定）')
  assert(countFilledCells(engine.board) <= ROWS * COLS, '棋盘格子数在合法范围内')

  // ---------- 2. 落点描述符合协议要求 ----------
  const snapshotEngine = new GameEngine(7)
  snapshotEngine.start()
  const snapshot = snapshotEngine.snapshot()
  const sample = enumeratePlacements(snapshot.board, snapshot.current!.type)
  const sampleText = describePlacement(snapshot.current!.type, rankPlacements(sample)[0], snapshot.nextTypes)
  console.log('  —— 送给 Laya 的中文落点陈述示例 ——')
  console.log(
    sampleText
      .split('\n')
      .map((line) => `    ${line}`)
      .join('\n'),
  )
  assert(sampleText.includes('列') && sampleText.includes('落点后'), '落点陈述包含列位置与落点后指标')

  // ---------- 3. Mock 决策管线端到端 ----------
  let progressEvents = 0
  const autopilot = new Autopilot(() => ({
    ...DEFAULT_SETTINGS,
    useMock: true,
    candidateCount: 6,
    concurrency: 4,
    threshold: 0.5,
  }))
  const result = await autopilot.decide(
    {
      board: snapshot.board,
      current: snapshot.current!.type,
      nextTypes: snapshot.nextTypes,
      pieceId: 1,
    },
    () => {
      progressEvents += 1
    },
  )

  assert(result !== null, '决策管线返回结果')
  if (result) {
    assert(result.candidates.length === 6, `候选数量与设置一致（${result.candidates.length}）`)
    assert(progressEvents >= 6, `候选逐个到达触发了进度回调（${progressEvents} 次）`)
    assert(
      result.candidates.every((item) => item.status === 'ok' && item.noul !== null),
      '所有候选都拿到 noul 概率',
    )
    assert(
      result.candidates.some((item) => item.id === result.selectedId),
      '选中候选存在于候选列表中',
    )
    assert(['laya', 'mock', 'heuristic-fallback'].includes(result.source), `决策来源合法（${result.source}）`)

    const body = result.candidates[0].request!
    const boardRows = body.state.board.split('\n')
    assert(boardRows.length === ROWS, `请求体 board 为 ${boardRows.length} 行（期望 ${ROWS}）`)
    assert(boardRows.every((row) => row.length === COLS), `请求体 board 每行 ${COLS} 列`)
    assert(boardRows.every((row) => /^[.#]+$/.test(row)), '请求体 board 只包含 # 与 .')
    assert(body.questions.is_good_placement.type === 'noul', 'questions.is_good_placement.type 为 noul')
    assert(typeof body.state.board_metrics.holes === 'number', 'board_metrics 字段完整')
    assert(body.state.next_pieces.length <= 3, 'next_pieces 不超过 3 个')

    assert(
      result.stages.placements > 0 && result.stages.candidateCount === result.candidates.length,
      `决策阶段信息完整（枚举 ${result.stages.placements} 个落点 → 候选 ${result.stages.candidateCount} 个）`,
    )
    assert(
      result.stages.enumerateMs >= 0 && result.stages.rankMs >= 0 && result.stages.queryMs >= 0,
      '决策各阶段耗时已记录（枚举/筛选/询问）',
    )

    console.log(
      `  选中落点：第 ${result.candidates.find((c) => c.id === result.selectedId)!.columnRange.join('~')} 列 · noul ${(
        result.candidates.find((c) => c.id === result.selectedId)!.noul ?? 0
      ).toFixed(4)}`,
    )
    console.log(`  决策理由：${result.reason}`)
  }

  // ---------- 4. 阈值兜底 ----------
  const fallbackAutopilot = new Autopilot(() => ({
    ...DEFAULT_SETTINGS,
    useMock: true,
    // 取滑块上限：Mock 的 noul 钳在 [0.01, 0.99]，用 0.99 会正好卡在钳位上
    // （`0.99 >= 0.99` 成立）而随机通过，断言就不稳了
    threshold: 1,
  }))
  const fallback = await fallbackAutopilot.decide({
    board: snapshot.board,
    current: snapshot.current!.type,
    nextTypes: snapshot.nextTypes,
    pieceId: 2,
  })
  assert(fallback?.source === 'heuristic-fallback', `阈值过高时降级为启发式兜底（${fallback?.source}）`)

  // ---------- 4b. 关闭兜底后完全由模型决策 ----------
  const pureAutopilot = new Autopilot(() => ({
    ...DEFAULT_SETTINGS,
    useMock: true,
    threshold: 1,
    heuristicFallback: false,
  }))
  const pure = await pureAutopilot.decide({
    board: snapshot.board,
    current: snapshot.current!.type,
    nextTypes: snapshot.nextTypes,
    pieceId: 2,
  })
  assert(pure?.source !== 'heuristic-fallback', `关闭兜底后即使阈值拉满也不降级（来源 ${pure?.source}）`)
  const okCandidates = pure?.candidates.filter((item) => item.status === 'ok' && item.noul !== null) ?? []
  const topNoul = Math.max(...okCandidates.map((item) => item.noul ?? 0))
  const picked = pure?.candidates.find((item) => item.id === pure.selectedId)
  assert(
    picked?.noul === topNoul,
    `关闭兜底后选中 noul 最高的候选（选中 ${picked?.noul?.toFixed(4)} / 最高 ${topNoul.toFixed(4)}）`,
  )

  // ---------- 5. 运行时的分阶段落子节奏 ----------
  runtime.init()
  useGameStore.getState().setMode('heuristic')
  runtime.onModeChanged()
  runtime.start()
  const startedWall = performance.now()
  await new Promise((resolve) => setTimeout(resolve, 4200))
  const pieces = useGameStore.getState().stats.pieces
  const wall = (performance.now() - startedWall) / 1000
  const phase = useGameStore.getState().phase
  runtime.pause()
  runtime.dispose()

  assert(pieces >= 2, `分阶段落子：${wall.toFixed(1)}s 内完成 ${pieces} 个方块（当前阶段 ${phase}）`)
  assert(wall / Math.max(1, pieces) > 0.6, `每个方块平均耗时 ${(wall / Math.max(1, pieces)).toFixed(2)}s，足够观察完整落子过程`)

  console.log('\n验证完成。')
}

await main()
