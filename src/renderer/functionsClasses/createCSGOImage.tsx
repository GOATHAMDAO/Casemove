export function createCSGOImage(urlEndpath: string): string {
  const imagePath = String(urlEndpath || '').replace(/^\/+/, '');
  if (imagePath === 'casemove-storage-unit') {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect x='7' y='18' width='50' height='36' rx='6' fill='%23374151'/%3E%3Cpath d='M7 28h50' stroke='%239ca3af' stroke-width='5'/%3E%3Cpath d='M27 33h10v8H27z' fill='%236366f1'/%3E%3Cpath d='M15 12h34v8H15z' fill='%23515d6d'/%3E%3C/svg%3E";
  }
  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath;
  }

  // Fallback for an item absent from the local image catalog. The tracker
  // stores converted Panorama textures with the `_png.png` suffix.
  return `https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/${imagePath}_png.png`;
}
