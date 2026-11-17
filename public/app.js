let currentUser = null;

async function loadUser() {
  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    currentUser = data.user;
  } catch {
    currentUser = null;
  }

  const loginButton = document.getElementById('nav-login');
  const logoutButton = document.getElementById('nav-logout');
  const roleButton = document.getElementById('nav-role');
  const userLabel = document.getElementById('nav-user');
  const flyerLink = document.getElementById('flyer-nav-link');

  if (!currentUser) {
    loginButton?.classList.remove('hidden');
    logoutButton?.classList.add('hidden');
    roleButton?.classList.add('hidden');
    userLabel?.classList.add('hidden');
  } else {
    loginButton?.classList.add('hidden');
    logoutButton?.classList.remove('hidden');
    roleButton?.classList.remove('hidden');
    userLabel?.classList.remove('hidden');
    if (userLabel) userLabel.textContent = `${currentUser.name} · ${currentUser.role}`;
  }

  if (flyerLink) {
    flyerLink.classList.toggle('hidden', !currentUser || currentUser.role !== 'admin');
  }
}

async function toggleRole() {
  await fetch('/api/me/toggle-role', { method: 'POST' });
  await loadUser();
  if (currentUser?.role !== 'admin') {
    document.querySelectorAll('[data-admin-only]').forEach((element) => element.classList.add('hidden'));
  }
}

async function logout() {
  await fetch('/auth/logout', { method: 'POST' });
  window.location.href = '/';
}

function setupNav() {
  document.getElementById('nav-login')?.addEventListener('click', () => {
    window.location.href = '/auth/google';
  });
  document.getElementById('nav-role')?.addEventListener('click', toggleRole);
  document.getElementById('nav-logout')?.addEventListener('click', logout);
  loadUser();
}

function setupCarousel() {
  const slides = [...document.querySelectorAll('.carousel-slide')];
  const dots = [...document.querySelectorAll('.carousel-dots button')];
  if (!slides.length) return;
  let index = 0;

  function show(nextIndex) {
    slides.forEach((slide, i) => slide.classList.toggle('active', i === nextIndex));
    dots.forEach((dot, i) => dot.classList.toggle('active', i === nextIndex));
    index = nextIndex;
  }

  dots.forEach((dot, i) => dot.addEventListener('click', () => show(i)));
  setInterval(() => show((index + 1) % slides.length), 6000);
}

setupNav();
setupCarousel();

async function loadPageFeatures() {
  const page = document.body.dataset.page;
  if (page === 'events') await setupEventsPage();
  if (page === 'langar') setupLangarPage();
  if (page === 'flyer') setupFlyerPage();
}

async function setupEventsPage() {
  const grid = document.getElementById('photo-grid');
  if (!grid) return;

  async function loadPhotos() {
    const res = await fetch('/api/photos');
    const photos = await res.json();
    if (!photos.length) {
      grid.innerHTML = '<p class="text-sm text-slate-500 col-span-full">No event photos have been added yet.</p>';
      return;
    }

    grid.innerHTML = '';
    photos.forEach((photo) => {
      const card = document.createElement('article');
      card.className = 'border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm';
      card.innerHTML = `
        <img src="${photo.url}" alt="${photo.title}" class="w-full h-52 object-cover bg-slate-200" />
        <div class="p-4 flex items-center justify-between gap-3">
          <span class="text-sm font-semibold truncate">${photo.title}</span>
          <button data-id="${photo.id}" class="delete-photo-btn hidden px-2.5 py-1 bg-red-600 text-white text-xs font-medium rounded-lg">Delete</button>
        </div>`;
      grid.appendChild(card);
    });

    await loadUser();
    if (currentUser?.role === 'admin') {
      document.querySelectorAll('.delete-photo-btn').forEach((button) => button.classList.remove('hidden'));
    }
  }

  grid.addEventListener?.('click', async (event) => {
    const button = event.target.closest('.delete-photo-btn');
    if (!button) return;
    const res = await fetch(`/api/photos/${button.dataset.id}`, { method: 'DELETE' });
    const data = await res.json();
    const feedback = document.getElementById('rbac-feedback');
    feedback.classList.remove('hidden');
    feedback.textContent = res.ok ? data.message : `${res.status}: ${data.error}`;
    if (res.ok) await loadPhotos();
  });

  document.getElementById('upload-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = document.getElementById('photo-title');
    const file = document.getElementById('photo-file');
    const feedback = document.getElementById('upload-feedback');
    const uploadButton = document.getElementById('upload-btn');
    if (!file.files[0]) return;

    uploadButton.disabled = true;
    uploadButton.textContent = 'Compressing & Uploading...';
    try {
      const compressed = await window.imageCompression(file.files[0], {
        maxSizeMB: 1,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
      });
      const formData = new FormData();
      formData.append('title', title.value);
      formData.append('image', compressed, compressed.name);
      const res = await fetch('/api/photos', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      feedback.textContent = 'Photo uploaded successfully.';
      title.value = '';
      file.value = '';
      await loadPhotos();
    } catch (error) {
      feedback.textContent = `Error: ${error.message}`;
    } finally {
      uploadButton.disabled = false;
      uploadButton.textContent = 'Compress & Upload';
    }
  });

  await loadPhotos();
}

function setupLangarPage() {
  import('/vendor/date-fns/nextSunday.js').then(async ({ nextSunday }) => {
    const [{ addWeeks }, { format }] = await Promise.all([
      import('/vendor/date-fns/addWeeks.js'),
      import('/vendor/date-fns/format.js'),
    ]);
    const list = document.getElementById('sundays-list');
    if (!list) return;
    let firstSunday = nextSunday(new Date());
    list.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const sunday = addWeeks(firstSunday, i);
      const item = document.createElement('li');
      item.className = 'flex items-center justify-between p-4 rounded-xl bg-emerald-50 border border-emerald-200';
      item.innerHTML = `<span class="font-medium text-emerald-900">${format(sunday, 'EEEE, MMMM d, yyyy')}</span><span class="text-xs font-bold px-2 py-1 rounded bg-emerald-600 text-white">Available</span>`;
      list.appendChild(item);
    }
  }).catch((error) => console.error('Langar schedule error:', error));
}

async function setupFlyerPage() {
  await loadUser();
  if (!currentUser || currentUser.role !== 'admin') {
    window.location.href = '/';
    return;
  }

  document.getElementById('flyer-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const eventName = document.getElementById('flyer-event-name').value;
    const eventDate = document.getElementById('flyer-event-date').value;
    const preview = document.getElementById('flyer-preview');
    const button = document.getElementById('generate-flyer-btn');
    button.disabled = true;
    button.textContent = 'Generating...';
    preview.innerHTML = '<p class="text-sm text-slate-600">Calling Gemini...</p>';

    try {
      const res = await fetch('/api/flyer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventName, eventDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate flyer');
      preview.innerHTML = data.html.replace(/```html|```/gi, '').trim();
    } catch (error) {
      preview.innerHTML = `<p class="text-sm text-red-600">Error: ${error.message}</p>`;
    } finally {
      button.disabled = false;
      button.textContent = 'Generate AI Flyer';
    }
  });

  document.getElementById('download-flyer-btn')?.addEventListener('click', async () => {
    const node = document.getElementById('flyer-preview');
    const dataUrl = await window.htmlToImage.toPng(node);
    const link = document.createElement('a');
    link.download = 'khalsa-school-flyer.png';
    link.href = dataUrl;
    link.click();
  });
}

loadPageFeatures();
