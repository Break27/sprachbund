// determine if this code is running locally
// (under node.js)
const NATIVE = typeof window === 'undefined'
// paths config
export const PATH = {};

PATH.CONFIG   = 'config.yaml';
PATH.OUTPUT   = 'dist';
PATH.OBJECT   = `${NATIVE ? PATH.OUTPUT : ''}/.objects`;
PATH.INDEX    = `${PATH.OBJECT}/index`;
PATH.METADATA = `${PATH.OBJECT}/metadata`;
