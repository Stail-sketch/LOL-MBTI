// firebase.js - Firebase初期化・DB操作
const firebaseConfig={
  apiKey:"AIzaSyCRaYGkHRjiIdMciatsLvhcicH_Ngy3Kc8",
  authDomain:"lol-mbti-4e6b2.firebaseapp.com",
  databaseURL:"https://lol-mbti-4e6b2-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:"lol-mbti-4e6b2",
  storageBucket:"lol-mbti-4e6b2.firebasestorage.app",
  messagingSenderId:"500085932537",
  appId:"1:500085932537:web:ac28513e2d2274b0a83d28",
  measurementId:"G-9PPHF9LNH7"
};
firebase.initializeApp(firebaseConfig);
const db=firebase.database();
