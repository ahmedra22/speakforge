import {createAppServer} from '../src/app/server.js';
const server=createAppServer();const port=Number(process.env.PORT??4173);server.listen(port,()=>console.log(`SpeakForge available at http://localhost:${port}`));
