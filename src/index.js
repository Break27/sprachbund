import app from './scripts/app'
import Alpine from 'alpinejs'


window.Alpine = Alpine;

Alpine.data('app', app);
Alpine.start();
