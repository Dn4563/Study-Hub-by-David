/* Start: the course home page, or the unit named after # in the address. */
if (UNIT) {
  initShell();
  initPT();
  restoreL();
}
render();
/* What's new since this browser last looked (js/06-news.js). */
newsLoad(newsCheck);
