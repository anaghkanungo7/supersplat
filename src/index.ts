import './ui/scss/style.scss';
import { version as pcuiVersion, revision as pcuiRevision } from '@playcanvas/pcui';
import { version as stVersion, revision as stRevision } from '@playcanvas/splat-transform';
import { version as engineVersion, revision as engineRevision } from 'playcanvas';

import { main } from './main';
import { version as appVersion } from '../package.json';

// print out versions of dependent packages
// NOTE: add dummy style reference to prevent tree shaking
console.log(`SVG Genie Splat Studio v${appVersion} (based on SuperSplat) | SplatTransform v${stVersion} (${stRevision}) | Engine v${engineVersion} (${engineRevision}) | PCUI v${pcuiVersion} (${pcuiRevision})`);

const showFatalError = (error: unknown) => {
    console.error('SVG Genie Splat Studio failed to start:', error);

    const overlay = document.createElement('main');
    overlay.id = 'fatal-error';
    overlay.setAttribute('role', 'alert');

    const title = document.createElement('h1');
    title.textContent = 'Splat Studio could not start';

    const message = document.createElement('p');
    message.textContent = error instanceof Error ?
        error.message :
        'Your browser could not initialize the 3D editor. WebGL 2 and hardware acceleration are required.';

    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Retry';
    retry.addEventListener('click', () => window.location.reload());

    const back = document.createElement('a');
    back.href = '/tools/image-to-3d-model';
    back.textContent = 'Back to Image to 3D';

    overlay.append(title, message, retry, back);
    document.body.appendChild(overlay);
};

main().catch(showFatalError);
