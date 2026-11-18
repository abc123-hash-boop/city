import {defineConfig,loadEnv} from 'vite';
import {residentAPI} from './server/brain.js';
export default defineConfig(({mode})=>{
 // Never expose the server's LLM credentials through VITE_* substitutions.
 const values=loadEnv(mode,process.cwd(),'LLM_');for(const k of ['LLM_BASE_URL','LLM_MODEL','LLM_API_KEY'])if(!process.env[k]&&values[k])process.env[k]=values[k];
 return {server:{host:'0.0.0.0',port:5173,allowedHosts:true},preview:{host:'0.0.0.0',port:5173,allowedHosts:true},plugins:[{name:'resident-brain',configureServer(s){s.middlewares.use(residentAPI())},configurePreviewServer(s){s.middlewares.use(residentAPI())}}],build:{modulePreload:false,chunkSizeWarningLimit:850,rollupOptions:{output:{inlineDynamicImports:true}}}};
});
