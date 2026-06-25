declare module "epubjs" {
  const ePub: (input: ArrayBuffer | string | Blob) => unknown;
  export default ePub;
}