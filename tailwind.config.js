/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // 休闲游戏字体：Fredoka 圆润饱满，中文回落系统黑体
        display: ['Fredoka', 'Nunito', 'system-ui', 'sans-serif'],
        brand: ['Fredoka', 'Nunito', 'system-ui', 'sans-serif'],
        fun: ['Fredoka', 'Nunito', 'system-ui', 'sans-serif'],
        nunito: ['Nunito', 'system-ui', 'sans-serif'],
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          'system-ui',
          'sans-serif',
        ],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // 糖果配色：高饱和但不刺眼；文字用深海军蓝保证对比度
        candy: {
          sky: '#3EC7F0',
          lemon: '#FFC93C',
          grape: '#B47CF7',
          mint: '#4FD98B',
          berry: '#FF7A8A',
          blue: '#5B8DEF',
          orange: '#FF9F5A',
          pink: '#FF7AA8',
          // 正文与标题：在白色面板上对比度 ≥ 12:1
          ink: '#0F2F4D',
          // 次级文字：对比度 ≈ 6:1，小字号也能看清
          muted: '#4C6D93',
          // 亮色糖果底上的文字色（比白色清楚得多）
          deep: '#0B2A44',
          // 卡片描边：让白色面板从浅蓝背景上分离出来
          line: '#D3E5F7',
        },
        cloud: {
          50: '#F7FBFF',
          100: '#EDF6FF',
          200: '#DCEBFF',
          300: '#C3DFFA',
          400: '#A6CDF3',
        },
        // 做旧的黑灰底：街机机台、铁皮机箱那种冷硬质感
        void: {
          950: '#07080B',
          900: '#0C0F14',
          850: '#11151C',
          800: '#161B24',
          700: '#1F2531',
          600: '#2B3341',
        },
        // 赛博朋克配色：主色是工业警示黄，辅以品红 / 青绿 / 荧光绿
        arc: {
          amber: '#FFB020',
          teal: '#2DD4BF',
          magenta: '#FF3D81',
          lime: '#A3E635',
          red: '#FF4D4D',
          blue: '#4C8DFF',
          purple: '#A78BFA',
          pink: '#F472B6',
          orange: '#FF7A1A',
        },
        ink: {
          DEFAULT: '#E9E6DF',
          muted: '#8C939E',
          dim: '#5C636E',
        },
      },
      // 整体上调一档字号：原来 9~12px 的说明文字太小，现在最小 13px
      fontSize: {
        xs: ['13px', '19px'],
        sm: ['15px', '22px'],
        base: ['16px', '25px'],
        lg: ['18px', '26px'],
        xl: ['21px', '29px'],
        '2xl': ['25px', '33px'],
        '3xl': ['30px', '38px'],
      },
      boxShadow: {
        // 硬阴影取代光晕：街机按钮那种实心投影
        slab: '0 22px 50px -30px rgba(0,0,0,0.98)',
        hard: '3px 3px 0 0 rgba(0,0,0,0.85)',
        'hard-sm': '2px 2px 0 0 rgba(0,0,0,0.8)',
        'hard-amber': '3px 3px 0 0 rgba(255,176,32,0.45)',
        bezel: 'inset 0 0 0 1px rgba(255,255,255,0.07), inset 0 3px 22px rgba(0,0,0,0.92)',
        // 3D 黏土质感按钮（上方柔光 + 下方厚度 + 落地投影）
        clay: 'inset 0 4px 8px 0 rgba(255,255,255,0.9), inset 0 -5px 0 0 rgba(11,42,68,0.16), 0 12px 22px -10px rgba(37,88,140,0.55)',
        'clay-sm':
          'inset 0 3px 6px 0 rgba(255,255,255,0.9), inset 0 -4px 0 0 rgba(11,42,68,0.14), 0 8px 16px -8px rgba(37,88,140,0.5)',
        'clay-pressed': 'inset 0 5px 10px 0 rgba(11,42,68,0.18), 0 3px 6px -3px rgba(37,88,140,0.4)',
        // 卡片与面板
        lite: '0 16px 34px -18px rgba(31,80,132,0.4)',
        'lite-sm': '0 10px 20px -12px rgba(31,80,132,0.45)',
        board: 'inset 0 3px 14px rgba(96,140,186,0.2), 0 22px 40px -22px rgba(31,80,132,0.5)',
        phone: '0 50px 90px -40px rgba(46,102,160,0.55), 0 0 0 1px rgba(255,255,255,0.6)',
      },
      // 补齐透明度刻度，让 /6 /8 /12 /14 /15 /22 /35 /45 /85 /88 /94 这些写法可用
      opacity: {
        6: '0.06',
        8: '0.08',
        12: '0.12',
        14: '0.14',
        15: '0.15',
        22: '0.22',
        35: '0.35',
        45: '0.45',
        55: '0.55',
        65: '0.65',
        72: '0.72',
        78: '0.78',
        85: '0.85',
        88: '0.88',
        94: '0.94',
      },
      backgroundImage: {
        'stripes-amber':
          'repeating-linear-gradient(45deg, rgba(255,176,32,0.85) 0px, rgba(255,176,32,0.85) 8px, rgba(10,10,10,0.9) 8px, rgba(10,10,10,0.9) 16px)',
        'hatch':
          'repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 4px)',
      },
      keyframes: {
        'float-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-down': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // 街机指示灯：硬切换的闪烁，而不是柔和呼吸
        'pulse-ring': {
          '0%, 55%': { opacity: '1', transform: 'scale(1)' },
          '56%, 100%': { opacity: '0.4', transform: 'scale(0.94)' },
        },
        blink: {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0.2' },
        },
        scan: {
          '0%': { transform: 'translateY(-110%)' },
          '100%': { transform: 'translateY(110%)' },
        },
        sweep: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(220%)' },
        },
        'marquee-in': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '70%': { opacity: '1', transform: 'translateY(-2px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // 手机版动效：数字弹跳、连击放大、提示上浮、背景光斑、按钮流光
        pop: {
          '0%': { transform: 'scale(1)' },
          '35%': { transform: 'scale(1.28)' },
          '70%': { transform: 'scale(0.96)' },
          '100%': { transform: 'scale(1)' },
        },
        'bounce-in': {
          '0%': { opacity: '0', transform: 'translateY(14px) scale(0.92)' },
          '60%': { opacity: '1', transform: 'translateY(-3px) scale(1.02)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'float-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '25%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-22px)' },
        },
        blob: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '33%': { transform: 'translate3d(18px,-14px,0) scale(1.06)' },
          '66%': { transform: 'translate3d(-14px,12px,0) scale(0.96)' },
        },
        sheen: {
          '0%': { transform: 'translateX(-140%) skewX(-18deg)' },
          '60%, 100%': { transform: 'translateX(240%) skewX(-18deg)' },
        },
      },
      animation: {
        'float-in': 'float-in 220ms cubic-bezier(0.22,1,0.36,1) both',
        'fade-down': 'fade-down 200ms ease-out both',
        'pulse-ring': 'pulse-ring 1s steps(1, end) infinite',
        blink: 'blink 1.1s steps(1, end) infinite',
        scan: 'scan 4.5s linear infinite',
        sweep: 'sweep 2.4s linear infinite',
        'marquee-in': 'marquee-in 280ms cubic-bezier(0.22,1,0.36,1) both',
        // 手机版
        pop: 'pop 420ms cubic-bezier(0.22,1.4,0.36,1) both',
        'bounce-in': 'bounce-in 460ms cubic-bezier(0.22,1.4,0.36,1) both',
        'float-up': 'float-up 900ms ease-out both',
        blob: 'blob 12s ease-in-out infinite',
        sheen: 'sheen 3.6s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
