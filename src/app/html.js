export const escapeHtml=(value='')=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const assetUrl=(asset)=>asset?`/assets/${asset.path.replace(/^resources\/covers\//,'')}`:'';
export const bookHref=(book)=>`/learn/${book.routeSlug}`;
export const unitHref=(book,number)=>`${bookHref(book)}/unit-${String(number).padStart(2,'0')}`;
