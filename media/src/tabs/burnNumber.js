/** Number field: dirty on input; commit on Enter / change / blur. */
export function bindBurnNumber(inputEl, markDirty, submit) {
  if (!inputEl) {
    return
  }
  inputEl.addEventListener('input', function () {
    markDirty()
  })
  inputEl.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      submit()
      inputEl.blur()
    }
  })
  inputEl.addEventListener('change', submit)
  inputEl.addEventListener('blur', submit)
}
