import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('#root 容器不存在')

// 刻意不使用 StrictMode：游戏主循环基于 requestAnimationFrame 与引擎单例，
// 双挂载会带来多余的一次初始化与订阅，实时演示下保持行为确定更重要。
createRoot(container).render(<App />)
