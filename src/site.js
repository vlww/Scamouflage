// Landing page: just the icons (the live demo runs in its own frame).
import { hydrateIcons } from './icons.js';
hydrateIcons();

// A family invite link (/?join=CODE) is passed through to the demo panel, scrolled into view.
const join = new URLSearchParams(location.search).get('join');
if (join) {
  const frame = document.querySelector('#try iframe');
  frame.src = `/sidepanel.html?join=${encodeURIComponent(join)}`;
  document.getElementById('try').scrollIntoView({ block: 'center' });
}
