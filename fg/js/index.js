(function () {
  var form = document.getElementById('searchForm');
  var input = document.getElementById('deliveryCodeInput');
  var errEl = document.getElementById('searchError');

  function showError(msg) {
    errEl.textContent = msg;
    errEl.style.display = msg ? 'block' : 'none';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var code = (input.value || '').trim();
    if (!code) {
      showError(FgI18n.t('errEmptyCode'));
      input.focus();
      return;
    }
    var item = OfficialReservation.getAppointment(code);
    if (!item) {
      showError(FgI18n.t('errInvalidCode'));
      return;
    }
    showError('');
    window.location.href = 'reservationDetail.html?code=' + encodeURIComponent(item.deliveryCode);
  });

  var prefill = (window.location.search.match(/[?&]code=([^&]+)/i) || [])[1];
  if (prefill) input.value = decodeURIComponent(prefill);
})();
