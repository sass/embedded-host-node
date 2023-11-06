// We need the legacy build to support Node14, but ColorJS does not export types
// with the legacy build -- so we point one to the other.
declare module 'colorjs.io/dist/color.legacy.cjs' {
  import Color from 'colorjs.io';

  export default Color;
}
