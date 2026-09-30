export const routes=[{id:'home',pattern:'/'},{id:'level',pattern:'/learn/:levelOrBookSlug'},{id:'unit',pattern:'/learn/:bookSlug/unit-:unitNumber'}];
export const bookRoute=(book)=>`/learn/${book.routeSlug}`;
export const unitRoute=(book,number)=>`${bookRoute(book)}/unit-${String(number).padStart(2,'0')}`;
