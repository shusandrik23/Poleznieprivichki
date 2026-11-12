// Настройки Firebase-проекта.
// Вставьте сюда объект firebaseConfig из консоли Firebase:
// Project settings → General → Your apps → Web app → SDK setup and configuration → Config.
// Эти значения не секретные: доступ к данным защищают правила из firestore.rules.
export const firebaseConfig = {
  apiKey: 'AIzaSyCoU36JR_tB4BZDj0ovhiNaBrNuUXQdcTo',
  authDomain: 'poleznie-privichki.firebaseapp.com',
  projectId: 'poleznie-privichki',
  storageBucket: 'poleznie-privichki.firebasestorage.app',
  messagingSenderId: '842120280158',
  appId: '1:842120280158:web:f8af42ef754ee9d9411ccf',
};

// Вход через Apple заработает после настройки Apple Developer (см. README).
export const appleSignInEnabled = false;
