// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      // tell Vite about every HTML entry-point
      input: {
        Home:          'index.html',
        adminlogin:     'adminlogin.html',
        dashboard:      'admindashboard.html',
        about:          'about.html',
        blog:           'blog.html',
        contacts:       'contacts.html',
        gallery:        'gallery.html',
        ministries:     'ministries.html'
      }
    }
  }
});
