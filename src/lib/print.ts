/**
 * Utility to reliably trigger browser print / PDF export
 * Handles clearing modal scroll-clipping and overflow restrictions
 */
export function triggerPrint() {
  const originalOverflow = document.body.style.overflow;
  document.body.style.overflow = 'visible';
  document.body.classList.add('is-printing');

  // Short delay to ensure DOM and CSS render printable layout
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.body.classList.remove('is-printing');
      document.body.style.overflow = originalOverflow;
    }, 500);
  }, 100);
}
