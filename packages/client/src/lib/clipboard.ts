export async function copyTextToClipboard(text: string, inputEl?: HTMLInputElement | HTMLTextAreaElement | null): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to the execCommand path — clipboard can reject on
      // non-HTTPS, missing permission, or when the document is unfocused.
    }
  }

  try {
    if (inputEl) {
      inputEl.focus()
      inputEl.select()
      inputEl.setSelectionRange(0, text.length)
      return document.execCommand('copy')
    }

    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '0'
    ta.style.left = '0'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}
