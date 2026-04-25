module.exports = {
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() })),
  useLocalSearchParams: jest.fn(() => ({})),
  Link: ({ children }) => children,
  router: { push: jest.fn(), replace: jest.fn() },
};
