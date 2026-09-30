const image = (path) => ({ path, mediaType: 'image/jpeg' });
const pdf = (path) => ({ path, mediaType: 'application/pdf' });
export const books = [
 {id:'a2-foundation',levelId:'a2',title:'Read to Speak A2',status:'available',sourcePdf:pdf('resources/books/a2/Read to Speak A2.pdf'),cover:image('resources/covers/a2.jfif')},
 {id:'b1-core',levelId:'b1',title:'Read to Speak B1',status:'available',sourcePdf:pdf('resources/books/b1/Read to Speak B1.pdf'),cover:image('resources/covers/b1.jfif')},
 {id:'b1-plus-bridge',levelId:'b1-plus',title:'Read to Speak B1+',status:'available',sourcePdf:pdf('resources/books/b1-plus/Read to Speak B1 +.pdf'),cover:image('resources/covers/b1-plus/b1+.jfif')},
 {id:'b2',levelId:'b2',title:'Read to Speak B2',status:'planned',sourcePdf:pdf('resources/books/b2/Read to Speak B2.pdf'),cover:image('resources/covers/b2/B2.jfif')},
 {id:'b2-plus',levelId:'b2-plus',status:'planned',cover:image('resources/covers/b2-plus/B2+.jfif')},
 {id:'c1',levelId:'c1',status:'planned',cover:image('resources/covers/c1/C1.jfif')},
];
export const levels = [
 {id:'a2',label:'A2 Foundation',order:1,status:'available',bookIds:['a2-foundation'],cover:image('resources/covers/a2.jfif')},
 {id:'b1',label:'B1 Core',order:2,status:'available',bookIds:['b1-core'],cover:image('resources/covers/b1.jfif')},
 {id:'b1-plus',label:'B1+ Bridge',order:3,status:'available',bookIds:['b1-plus-bridge'],cover:image('resources/covers/b1-plus/b1+.jfif')},
 {id:'b2',label:'B2',order:4,status:'planned',bookIds:['b2'],cover:image('resources/covers/b2/B2.jfif')},
 {id:'b2-plus',label:'B2+',order:5,status:'planned',bookIds:['b2-plus'],cover:image('resources/covers/b2-plus/B2+.jfif')},
 {id:'c1',label:'C1',order:6,status:'planned',bookIds:['c1'],cover:image('resources/covers/c1/C1.jfif')},
];
export const sourceSets = [
 {levelId:'a2',bookId:'a2-foundation',sourceFile:'resources/structured/a2/units.a2.json',audioDirectory:'resources/audio/a2',audioPrefix:'A2'},
 {levelId:'b1',bookId:'b1-core',sourceFile:'resources/structured/b1/units.b1.json',audioDirectory:'resources/audio/b1',audioPrefix:'B1'},
 {levelId:'b1-plus',bookId:'b1-plus-bridge',sourceFile:'resources/structured/b1-plus/units.b1-plus.json',audioDirectory:'resources/audio/b1-plus',audioPrefix:'B1+'},
];
export const expectedUnitCounts = {a2:10,b1:12,'b1-plus':12};
