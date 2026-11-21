// Firebase modular SDK (CDN). Substitui os valores abaixo pelos dados da tua aplicação Firebase.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, query, orderBy,
  serverTimestamp, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDJ6GdR4z-56hMSA3HWd0XMoSRd5i4oxMw",
  authDomain: "slaporra-df810.firebaseapp.com",
  projectId: "slaporra-df810",
  storageBucket: "slaporra-df810.firebasestorage.app",
  messagingSenderId: "1005160911500",
  appId: "1:1005160911500:web:b2cf1fb8f91553c5cb61a9",
  measurementId: "G-9TRL43ZEKR"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const postsCollection = collection(db, "posts");

const $ = (selector) => document.querySelector(selector);
const modal = $("#auth-modal");
const authForm = $("#auth-form");
let authMode = "login";
let currentUser = null;

$("#year").textContent = new Date().getFullYear();

function showMessage(text, isError = false) {
  const box = $("#message");
  box.textContent = text;
  box.classList.toggle("error", isError);
  box.classList.remove("hidden");
  window.setTimeout(() => box.classList.add("hidden"), 4500);
}
function openModal() {
  $("#auth-error").classList.add("hidden");
  modal.classList.remove("hidden");
}
function closeModal() { modal.classList.add("hidden"); }
function setAuthMode(mode) {
  authMode = mode;
  const registering = mode === "register";
  $("#login-tab").classList.toggle("active", !registering);
  $("#register-tab").classList.toggle("active", registering);
  $("#name-field").classList.toggle("hidden", !registering);
  $("#display-name").required = registering;
  $("#password").autocomplete = registering ? "new-password" : "current-password";
  $("#auth-title").textContent = registering ? "Cria a tua conta." : "Entra na conversa.";
  $("#auth-submit").textContent = registering ? "Criar conta" : "Entrar";
  $("#auth-error").classList.add("hidden");
}
function friendlyError(error) {
  const messages = {
    "auth/email-already-in-use": "Este email já está associado a uma conta.",
    "auth/invalid-email": "O endereço de email não é válido.",
    "auth/weak-password": "A palavra-passe deve ter pelo menos 6 caracteres.",
    "auth/invalid-credential": "Email ou palavra-passe incorretos.",
    "auth/user-not-found": "Não existe uma conta com este email.",
    "auth/wrong-password": "Palavra-passe incorreta.",
    "permission-denied": "Não tens permissão para executar esta ação. Verifica as regras do Firestore."
  };
  return messages[error.code] || error.message || "Ocorreu um erro. Tenta novamente.";
}

$("#open-auth").addEventListener("click", openModal);
$("#logout-button").addEventListener("click", async () => {
  try { await signOut(auth); showMessage("Sessão terminada."); }
  catch (error) { showMessage(friendlyError(error), true); }
});
document.querySelectorAll("[data-close-modal]").forEach(el => el.addEventListener("click", closeModal));
$("#login-tab").addEventListener("click", () => setAuthMode("login"));
$("#register-tab").addEventListener("click", () => setAuthMode("register"));

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = $("#auth-submit");
  const errorBox = $("#auth-error");
  submit.disabled = true;
  submit.textContent = "A processar…";
  errorBox.classList.add("hidden");
  try {
    const email = $("#email").value.trim();
    const password = $("#password").value;
    if (authMode === "register") {
      const name = $("#display-name").value.trim();
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    authForm.reset();
    closeModal();
    showMessage(authMode === "register" ? "Conta criada com sucesso!" : "Sessão iniciada.");
  } catch (error) {
    errorBox.textContent = friendlyError(error);
    errorBox.classList.remove("hidden");
  } finally {
    submit.disabled = false;
    submit.textContent = authMode === "register" ? "Criar conta" : "Entrar";
  }
});

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  $("#open-auth").classList.toggle("hidden", !!user);
  $("#logout-button").classList.toggle("hidden", !user);
  $("#user-label").textContent = user ? `Olá, ${user.displayName || user.email}` : "";
  $("#composer").classList.toggle("hidden", !user);
});

$("#post-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return openModal();
  const title = $("#post-title").value.trim();
  const content = $("#post-content").value.trim();
  if (!title || !content) return;
  const button = event.submitter;
  button.disabled = true;
  button.textContent = "A publicar…";
  try {
    await addDoc(postsCollection, {
      title,
      content,
      author: currentUser.displayName || currentUser.email,
      authorId: currentUser.uid,
      createdAt: serverTimestamp()
    });
    $("#post-form").reset();
    showMessage("Artigo publicado com sucesso!");
    await loadPosts();
  } catch (error) {
    showMessage(friendlyError(error), true);
  } finally {
    button.disabled = false;
    button.textContent = "Publicar artigo ↗";
  }
});

function formatDate(timestamp) {
  if (!timestamp?.toDate) return "Agora mesmo";
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short", year: "numeric" }).format(timestamp.toDate());
}
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

async function loadPosts() {
  const container = $("#posts");
  container.innerHTML = '<div class="loading-card">A carregar os artigos…</div>';
  try {
    const postsQuery = query(postsCollection, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(postsQuery);
    $("#post-count").textContent = `${snapshot.size} ${snapshot.size === 1 ? "artigo" : "artigos"}`;
    container.innerHTML = "";
    $("#empty-state").classList.toggle("hidden", !snapshot.empty);
    snapshot.forEach((postDoc) => {
      const post = postDoc.data();
      const card = document.createElement("article");
      card.className = "post-card";
      const canDelete = currentUser && currentUser.uid === post.authorId;
      card.innerHTML = `
        <span class="post-category">ARTIGO · ENTRELInHAS</span>
        <h3>${escapeHtml(post.title)}</h3>
        <p class="post-excerpt">${escapeHtml(post.content)}</p>
        <div class="post-meta">
          <span>Por ${escapeHtml(post.author || "Anónimo")} · ${formatDate(post.createdAt)}</span>
          ${canDelete ? `<button class="delete-post" type="button" aria-label="Apagar artigo">Apagar</button>` : ""}
        </div>`;
      if (canDelete) {
        card.querySelector(".delete-post").addEventListener("click", async () => {
          if (!confirm("Tens a certeza de que queres apagar este artigo?")) return;
          try {
            await deleteDoc(doc(db, "posts", postDoc.id));
            showMessage("Artigo apagado.");
            await loadPosts();
          } catch (error) { showMessage(friendlyError(error), true); }
        });
      }
      container.appendChild(card);
    });
  } catch (error) {
    container.innerHTML = "";
    $("#post-count").textContent = "Não foi possível carregar";
    showMessage(friendlyError(error), true);
  }
}

setAuthMode("login");
loadPosts();
