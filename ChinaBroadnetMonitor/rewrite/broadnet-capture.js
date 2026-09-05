/**
 * ChinaBroadnetMonitor request capture/injection bridge.
 * Supports Surge and Loon request-script environments.
 *
 * It stores only the access header and encrypted body.data in the proxy app.
 * It never logs or returns either value to Scripting's local storage.
 */
;(function () {
  const STORE_KEY = "china_broadnet.capture.v1"
  const SCRIPTING_MARKER = "x-chinabroadnet-scripting"

  function headerEntry(headers, expectedName) {
    const lowerName = expectedName.toLowerCase()
    return Object.keys(headers || {}).find(
      key => String(key).toLowerCase() === lowerName,
    )
  }

  function headerValue(headers, name) {
    const key = headerEntry(headers, name)
    return key ? String(headers[key] || "") : ""
  }

  function removeHeader(headers, name) {
    const key = headerEntry(headers, name)
    if (key) delete headers[key]
  }

  function setHeader(headers, name, value) {
    const key = headerEntry(headers, name)
    headers[key || name] = value
  }

  function parseBody(body) {
    if (typeof body !== "string" || !body) return null
    try {
      const parsed = JSON.parse(body)
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : null
    } catch (_) {
      return null
    }
  }

  function readCapture() {
    try {
      const raw = $persistentStore.read(STORE_KEY)
      if (!raw) return null
      const saved = JSON.parse(raw)
      return saved &&
        typeof saved.access === "string" &&
        saved.access &&
        typeof saved.data === "string" &&
        saved.data
        ? saved
        : null
    } catch (_) {
      return null
    }
  }

  const requestHeaders = Object.assign({}, $request.headers || {})
  const requestBody = parseBody($request.body)
  const isScriptingRequest =
    headerValue(requestHeaders, SCRIPTING_MARKER) === "1"

  if (!isScriptingRequest) {
    const access = headerValue(requestHeaders, "access").trim()
    const data =
      requestBody && typeof requestBody.data === "string"
        ? requestBody.data.trim()
        : ""

    if (access && data) {
      $persistentStore.write(
        JSON.stringify({ access, data, capturedAt: Date.now() }),
        STORE_KEY,
      )
    }
    $done({})
    return
  }

  removeHeader(requestHeaders, SCRIPTING_MARKER)
  const capture = readCapture()
  if (!capture) {
    $done({ headers: requestHeaders })
    return
  }

  const injectedBody = requestBody || {}
  injectedBody.data = capture.data
  setHeader(requestHeaders, "access", capture.access)
  $done({
    headers: requestHeaders,
    body: JSON.stringify(injectedBody),
  })
})()
