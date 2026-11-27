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
  const userLabel = document.getElementById('nav-user');
  const flyerLink = document.getElementById('flyer-nav-link');

  if (!currentUser) {
    loginButton?.classList.remove('hidden');
    logoutButton?.classList.add('hidden');
    userLabel?.classList.add('hidden');
  } else {
    loginButton?.classList.add('hidden');
    logoutButton?.classList.remove('hidden');
    userLabel?.classList.remove('hidden');
    if (userLabel) userLabel.textContent = `${currentUser.name} · ${currentUser.role}`;
  }

  if (flyerLink) {
    flyerLink.classList.toggle('hidden', !currentUser || currentUser.role !== 'Admin');
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
  if (page === 'event-photos') await setupEventPhotosPage();
  if (page === 'langar') setupLangarPage();
  if (page === 'flyer') setupFlyerPage();
}

async function setupEventsPage() {
  const grid = document.getElementById('events-grid');
  if (!grid) return;
  await loadUser();

  const createButton = document.getElementById('create-event-button');
  const dialog = document.getElementById('create-event-dialog');
  const form = document.getElementById('create-event-form');
  const feedback = document.getElementById('create-event-feedback');
  const saveButton = document.getElementById('save-event-button');
  if (currentUser?.role === 'Admin') {
    createButton.classList.remove('hidden');
    createButton.addEventListener('click', () => dialog.showModal());
  }
  document.getElementById('close-event-dialog').addEventListener('click', () => dialog.close());
  document.getElementById('cancel-event-dialog').addEventListener('click', () => dialog.close());

  form.addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();
    feedback.classList.add('hidden');
    const formData = new FormData(form);
    const dateStart = new Date(formData.get('dateStart'));
    const dateEnd = new Date(formData.get('dateEnd'));
    if (dateEnd <= dateStart) {
      feedback.textContent = 'The end date must be after the start date.';
      feedback.classList.remove('hidden');
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = 'Creating...';
    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: formData.get('eventName'),
          description: formData.get('description'),
          location: formData.get('location'),
          dateStart: dateStart.toISOString(),
          dateEnd: dateEnd.toISOString(),
          isPublished: form.elements.isPublished.checked,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not create event.');
      form.reset();
      dialog.close();
      await loadEvents();
    } catch (error) {
      feedback.textContent = error.message;
      feedback.classList.remove('hidden');
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Create event';
    }
  });

  async function loadEvents() {
    try {
      const message = document.getElementById('events-feedback');
      message.classList.add('hidden');
      const response = await fetch('/api/events');
      const events = await response.json();
      if (!response.ok) throw new Error(events.error || 'Unable to load events.');
      grid.replaceChildren();
      if (!events.length) {
        const empty = document.createElement('p');
        empty.className = 'text-sm text-slate-500 col-span-full';
        empty.textContent = 'No events are available yet.';
        grid.appendChild(empty);
        return;
      }

      events.forEach((event) => {
        const link = document.createElement('a');
        link.href = `/event-photos.html?eventId=${encodeURIComponent(event.id)}`;
        link.className = 'block rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-indigo-400 hover:shadow-md transition';
        const title = document.createElement('h2');
        title.className = 'text-xl font-bold text-indigo-950';
        title.textContent = event.eventName;
        const date = document.createElement('p');
        date.className = 'mt-2 text-sm text-slate-600';
        date.textContent = `${formatEventDate(event.dateStart)} – ${formatEventDate(event.dateEnd)}`;
        link.append(title, date);
        if (event.location) {
          const location = document.createElement('p');
          location.className = 'mt-1 text-sm text-slate-500';
          location.textContent = event.location;
          link.appendChild(location);
        }
        if (event.description) {
          const description = document.createElement('p');
          description.className = 'mt-3 text-sm text-slate-600';
          description.textContent = event.description;
          link.appendChild(description);
        }
        if (!event.isPublished) {
          const draft = document.createElement('span');
          draft.className = 'mt-3 inline-block rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800';
          draft.textContent = 'Unpublished';
          link.appendChild(draft);
        }
        grid.appendChild(link);
      });
    } catch (error) {
      grid.replaceChildren();
      const message = document.getElementById('events-feedback');
      message.textContent = error.message;
      message.classList.remove('hidden');
    }
  }

  await loadEvents();
}

function formatEventDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

async function setupEventPhotosPage() {
  await loadUser();
  const eventId = new URLSearchParams(window.location.search).get('eventId');
  const title = document.getElementById('event-title');
  const details = document.getElementById('event-details');
  const feedback = document.getElementById('upload-feedback');
  if (!eventId || !/^\d+$/.test(eventId)) {
    title.textContent = 'Event not found';
    feedback.textContent = 'Choose an event from the events page.';
    return;
  }

  try {
    const response = await fetch(`/api/events/${encodeURIComponent(eventId)}`);
    const event = await response.json();
    if (!response.ok) throw new Error(event.error || 'Event not found.');
    title.textContent = event.eventName;
    document.title = `${event.eventName} Photos | SGSS Khalsa School`;
    details.textContent = [
      `${formatEventDate(event.dateStart)} – ${formatEventDate(event.dateEnd)}`,
      event.location,
    ].filter(Boolean).join(' · ');
    document.getElementById('download-photos-zip').href =
      `/api/photos/zip?eventId=${encodeURIComponent(eventId)}`;
    await setupPhotoGallery(eventId);
  } catch (error) {
    title.textContent = 'Event not found';
    feedback.textContent = error.message;
  }
}

async function setupPhotoGallery(eventId) {
  const grid = document.getElementById('photo-grid');
  const uploadForm = document.getElementById('upload-form');
  const uploadFeedback = document.getElementById('upload-feedback');
  const rbacFeedback = document.getElementById('rbac-feedback');
  const uploadButton = document.getElementById('upload-btn');

  async function loadPhotos() {
    const response = await fetch(`/api/photos?eventId=${encodeURIComponent(eventId)}`);
    const photos = await response.json();
    if (!response.ok) throw new Error(photos.error || 'Unable to load photos.');
    grid.replaceChildren();
    if (!photos.length) {
      const empty = document.createElement('p');
      empty.className = 'text-sm text-slate-500 col-span-full';
      empty.textContent = currentUser && ['Admin', 'Approver'].includes(currentUser.role)
        ? 'No photos are awaiting approval or approved for this event.'
        : 'No approved photos have been added to this event yet.';
      grid.appendChild(empty);
      return;
    }

    photos.forEach((photo) => {
      const card = document.createElement('article');
      card.className = 'border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm';
      const image = document.createElement('img');
      image.src = photo.url;
      image.alt = photo.title || 'Event photo';
      image.className = 'w-full h-52 object-cover bg-slate-200';
      const cardDetails = document.createElement('div');
      cardDetails.className = 'p-4 flex flex-wrap items-center justify-between gap-3';
      const photoTitle = document.createElement('span');
      photoTitle.className = 'text-sm font-semibold truncate';
      photoTitle.textContent = photo.title || 'Untitled photo';
      cardDetails.appendChild(photoTitle);
      if (photo.status === 'Pending') {
        const status = document.createElement('span');
        status.className = 'text-xs font-semibold text-amber-700';
        status.textContent = 'Pending approval';
        cardDetails.appendChild(status);
      }
      if (['Admin', 'Approver'].includes(currentUser?.role) && photo.status === 'Pending') {
        const approve = document.createElement('button');
        approve.dataset.id = photo.id;
        approve.className = 'approve-photo-btn px-2.5 py-1 bg-emerald-600 text-white text-xs font-medium rounded-lg';
        approve.textContent = 'Approve';
        cardDetails.appendChild(approve);
      }
      if (currentUser?.role === 'Admin') {
        const remove = document.createElement('button');
        remove.dataset.id = photo.id;
        remove.className = 'delete-photo-btn px-2.5 py-1 bg-red-600 text-white text-xs font-medium rounded-lg';
        remove.textContent = 'Delete';
        cardDetails.appendChild(remove);
      }
      card.append(image, cardDetails);
      grid.appendChild(card);
    });
  }

  grid.addEventListener('click', async (event) => {
    const button = event.target.closest('.delete-photo-btn, .approve-photo-btn');
    if (!button) return;
    const isApproval = button.classList.contains('approve-photo-btn');
    const response = await fetch(
      `/api/photos/${button.dataset.id}${isApproval ? '/approve' : ''}`,
      { method: isApproval ? 'POST' : 'DELETE' }
    );
    const result = await response.json();
    rbacFeedback.classList.remove('hidden');
    rbacFeedback.textContent = response.ok
      ? result.message
      : `${response.status}: ${result.error || 'Request failed'}`;
    if (response.ok) await loadPhotos();
  });

  uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = document.getElementById('photo-file');
    const title = document.getElementById('photo-title');
    const guestName = document.getElementById('guest-name');
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
      formData.append('guestName', guestName.value);
      formData.append('eventId', eventId);
      formData.append('image', compressed, compressed.name);
      const response = await fetch('/api/photos', { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Upload failed');
      uploadFeedback.textContent = 'Photo uploaded and is awaiting approval.';
      title.value = '';
      guestName.value = '';
      file.value = '';
      await loadPhotos();
    } catch (error) {
      uploadFeedback.textContent = `Error: ${error.message}`;
    } finally {
      uploadButton.disabled = false;
      uploadButton.textContent = 'Compress & Upload';
    }
  });

  try {
    await loadPhotos();
  } catch (error) {
    uploadFeedback.textContent = error.message;
  }
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
  if (!currentUser || currentUser.role !== 'Admin') {
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
