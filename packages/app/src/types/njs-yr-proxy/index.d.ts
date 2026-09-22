declare module '@docker/njs/yr-proxy.js' {
  const yrProxy: {
    handle(request: {
      uri: string;
      args: { date?: string; lat?: string; lon?: string };
      headersOut: Record<string, string>;
      return(status: number, body: string): void;
    }): Promise<void>;
  };
  export default yrProxy;
}
