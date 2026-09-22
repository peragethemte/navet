declare module '@docker/njs/icloud-proxy.js' {
  const icloudProxy: {
    handle(request: {
      uri: string;
      method: string;
      variables: { args?: string };
      headersOut: Record<string, string>;
      subrequest(
        uri: string,
        options: { method: string; args: string }
      ): Promise<{ status: number; responseText: string }>;
      return(status: number, body: string): void;
    }): Promise<void>;
  };
  export default icloudProxy;
}
