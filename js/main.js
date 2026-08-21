(function () {
  'use strict';

  var burger = document.querySelector('.hdr-burger');
  var mobMenu = document.querySelector('.mob-menu');

  if (burger && mobMenu) {
    var focusableSelector = 'a[href], button:not([disabled])';

    function openMenu() {
      mobMenu.hidden = false;
      mobMenu.classList.add('open');
      burger.setAttribute('aria-expanded', 'true');
      var firstLink = mobMenu.querySelector(focusableSelector);
      if (firstLink) firstLink.focus();
      document.addEventListener('keydown', onKeydown);
    }

    function closeMenu(returnFocus) {
      mobMenu.hidden = true;
      mobMenu.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
      document.removeEventListener('keydown', onKeydown);
      if (returnFocus) burger.focus();
    }

    function onKeydown(e) {
      if (e.key === 'Escape') {
        closeMenu(true);
        return;
      }
      if (e.key === 'Tab') {
        var focusables = Array.prototype.slice.call(mobMenu.querySelectorAll(focusableSelector));
        if (!focusables.length) return;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    burger.addEventListener('click', function () {
      var expanded = burger.getAttribute('aria-expanded') === 'true';
      if (expanded) {
        closeMenu(false);
      } else {
        openMenu();
      }
    });

    mobMenu.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeMenu(false);
    });

    var mq = window.matchMedia('(min-width: 961px)');
    function handleBreakpointChange(e) {
      if (e.matches) closeMenu(false);
    }
    if (mq.addEventListener) {
      mq.addEventListener('change', handleBreakpointChange);
    } else if (mq.addListener) {
      mq.addListener(handleBreakpointChange);
    }
  }

  // smooth anchor scroll (header offset handled by scroll-margin-top in CSS)
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var id = link.getAttribute('href').slice(1);
      if (!id) return;
      var target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start'
      });
      target.focus({ preventScroll: true });
    });
  });
})();
