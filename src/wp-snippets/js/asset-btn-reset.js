document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('wpforms-form-2501');
  if (!form) return;

  const indicator = form.querySelector('.wpforms-page-indicator.progress');
  if (!indicator) return;

  // Find the "Step X of Y" span
  const stepsSpan = indicator.querySelector('.wpforms-page-indicator-steps');
  if (!stepsSpan) return;

  // Create a header row that will hold the steps text (left) and Reset button (right)
  const header = document.createElement('div');
  header.className = 'shoshin-progress-header';

  // Insert header *before* the existing steps span
  indicator.insertBefore(header, stepsSpan);

  // Move the existing steps span into the header
  header.appendChild(stepsSpan);

  // Create the Reset button
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'shoshin-reset-btn-top';
  resetBtn.textContent = 'Reset';

  // Add button to header (it will align to the right via CSS)
  header.appendChild(resetBtn);

  // Reset behavior: full form reset by reloading the page (same as Character Creator)
  resetBtn.addEventListener('click', function () {
    window.location.reload();
  });
});
