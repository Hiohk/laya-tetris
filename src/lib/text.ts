/** 统一的中文引号包裹，避免在字符串里写转义引号 */
export function quoteText(value: string, left = '「', right = '」'): string {
  return `${left}${value}${right}`
}
