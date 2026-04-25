const store = {};
module.exports = {
  setItemAsync: jest.fn((key, value) => { store[key] = value; return Promise.resolve(); }),
  getItemAsync: jest.fn((key) => Promise.resolve(store[key] ?? null)),
  deleteItemAsync: jest.fn((key) => { delete store[key]; return Promise.resolve(); }),
};
