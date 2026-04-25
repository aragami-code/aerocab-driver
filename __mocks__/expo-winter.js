// Stub for expo/src/winter/* and related modules in Jest environment.
// The winter runtime uses import.meta which is not available in Node/Jest.
module.exports = {
  ImportMetaRegistry: { url: 'http://localhost' },
  getBundleUrl: () => 'http://localhost',
  install: () => {},
  installGlobal: () => {},
  installFormDataPatch: () => {},
};
