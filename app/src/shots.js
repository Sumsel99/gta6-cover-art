// Fixed scenes for screenshots: ?shot=cover shows the PNG the app itself
// exported, ?shot=editor shows the editor with photos loaded, ?shot=sizes
// shows the three export sizes side by side. window.__shotReady is set once
// the scene has painted, so a headless browser can wait on it.

export async function runShot(shot, query, api) {
  const caption = query.get('caption');
  const layout = query.get('layout');
  const grade = query.get('grade');
  const size = query.get('size');
  const photo = query.get('photo');
  if (layout) api.setLayout(layout);
  if (grade) api.setGrade(grade);
  if (size) api.setSize(size);
  if (caption) api.setCaption(caption, query.get('subtitle') ?? undefined);
  if (photo) api.setPhoto(photo);
  await api.fontsReady();
  api.redraw();

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const blob = await api.exportPng();
    const url = URL.createObjectURL(blob);
    const img = document.getElementById('shotImage');
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
      img.src = url;
    });
  } else if (shot === 'sizes') {
    document.body.classList.add('shot-sizes');
    const stage = document.getElementById('sizesStage');
    stage.innerHTML = '';
    const sizes = [
      ['1920x1080', '1920 × 1080 · landscape'],
      ['1080x1080', '1080 × 1080 · square'],
      ['1080x1350', '1080 × 1350 · portrait'],
    ];
    for (const [key, label] of sizes) {
      const blob = await api.exportPng(key);
      const url = URL.createObjectURL(blob);
      const cell = document.createElement('div');
      cell.className = 'sizes-cell';
      const img = document.createElement('img');
      img.alt = label;
      img.src = url;
      const cap = document.createElement('span');
      cap.textContent = label;
      cell.append(img, cap);
      stage.append(cell);
      await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
    }
    // Heights chosen so the three cells fit a 1280-wide frame with gaps.
    const imgs = stage.querySelectorAll('img');
    if (imgs[0]) imgs[0].style.height = '300px';
    if (imgs[1]) imgs[1].style.height = '300px';
    if (imgs[2]) imgs[2].style.height = '375px';
  } else if (shot === 'editor') {
    document.body.classList.add('shot-editor');
  }
  // Editor scene needs no extra work: the editor is already showing.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
