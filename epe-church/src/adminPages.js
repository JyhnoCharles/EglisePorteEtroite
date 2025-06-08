
//  Swtitches the page when the btn is pressed
const buttons = document.querySelectorAll('nav [data-view]');
const views   = document.querySelectorAll('.view');

buttons.forEach(btn => {
  btn.addEventListener('click', () => swapView(btn.dataset.view));
});

function swapView(id){
  views.forEach(v => v.hidden = (v.id !== id)); // show one, hide the rest
}


// Barcode input Checker

