import {build} from 'vite';process.env.VITE_LOBBY_URL='/api/lobby';await build({base:'/',build:{outDir:'.qa/resource-online'}});
