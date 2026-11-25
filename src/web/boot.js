// First import of the side panel. On the web demo it installs the chrome.* stand-in before any
// other module runs; in the extension build IS_WEB is false and this is dropped as dead code.
import { IS_WEB } from '../env.js';
import { installShim } from './shim.js';

if (IS_WEB) installShim();
