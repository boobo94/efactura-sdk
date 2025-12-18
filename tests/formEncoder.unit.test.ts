import {
  encodeForm,
  buildQueryString,
  encodeOAuthTokenRequest,
  buildOAuthAuthorizationUrl,
  extractOAuthCode,
  extractOAuthError,
} from '../src/utils/formEncoder';

describe('formEncoder utilities', () => {
  test('encodeForm produces a query string that parses back to original', () => {
    const obj = { a: 'b', c: 1, d: true };
    const encoded = encodeForm(obj as any);
    expect(encoded).toContain('a=b');
    expect(encoded).toContain('c=1');
    expect(encoded).toContain('d=true');
  });

  test('buildQueryString handles arrays and skips nulls', () => {
    const qs = buildQueryString({ a: 'b', arr: ['x', 'y'], n: null } as any);
    // Should contain a=b and arr=x&arr=y and should not contain n
    expect(qs).toContain('a=b');
    expect(qs).toContain('arr=x');
    expect(qs).toContain('arr=y');
    expect(qs).not.toContain('n=');
  });

  test('encodeOAuthTokenRequest includes optional fields when provided', () => {
    const encoded = encodeOAuthTokenRequest({
      grant_type: 'authorization_code',
      client_id: 'cid',
      client_secret: 'secret',
      redirect_uri: 'https://app/cb',
      code: 'abc',
      refresh_token: 'r',
      token_content_type: 'json',
    });

    expect(encoded).toContain('grant_type=authorization_code');
    expect(encoded).toContain('code=abc');
    expect(encoded).toContain('refresh_token=r');
    expect(encoded).toContain('token_content_type=json');
  });

  test('buildOAuthAuthorizationUrl builds a valid URL with provided params', () => {
    const url = buildOAuthAuthorizationUrl('https://auth.example/authorize', {
      client_id: 'cid',
      response_type: 'code',
      redirect_uri: 'https://app/cb',
      scope: 'openid email',
      token_content_type: 'json',
    });

    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://auth.example/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('cid');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('scope')).toBe('openid email');
    expect(parsed.searchParams.get('token_content_type')).toBe('json');
  });

  test('extractOAuthCode extracts code or returns null on invalid input', () => {
    expect(extractOAuthCode('https://app/cb?code=abc123')).toBe('abc123');
    expect(extractOAuthCode('not-a-url')).toBeNull();
  });

  test('extractOAuthError returns structured error information', () => {
    const res = extractOAuthError('https://app/cb?error=access_denied&error_description=denied');
    expect(res).toEqual({ error: 'access_denied', error_description: 'denied' });

    const empty = extractOAuthError('https://app/cb');
    expect(empty).toEqual({ error: '', error_description: undefined });
  });
});
