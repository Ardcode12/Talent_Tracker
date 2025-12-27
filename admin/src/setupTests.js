import '@testing-library/jest-dom/extend-expect';
import { cleanup } from '@testing-library/react';
import 'jest-localstorage-mock';

afterEach(() => {
  cleanup();
});