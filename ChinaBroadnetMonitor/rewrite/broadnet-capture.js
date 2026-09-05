/**
 * ChinaBroadnetMonitor request capture/injection bridge.
 * Supports $persistentStore-style proxy runtimes and Quantumult X.
 *
 * It stores only the access header and encrypted body.data in the proxy app.
 * It never logs or returns either value to Scripting's local storage.
 */
;(function () {
  const STORE_KEY = "china_broadnet.capture.v1"
  const SCRIPTING_MARKER = "x-chinabroadnet-scripting"
  const STATUS_MARKER = "x-chinabroadnet-status"

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

  function readValue(key) {
    if (typeof $persistentStore !== "undefined") {
      return $persistentStore.read(key)
    }
    if (typeof $prefs !== "undefined") return $prefs.valueForKey(key)
    return null
  }

  function writeValue(value, key) {
    if (typeof $persistentStore !== "undefined") {
      return $persistentStore.write(value, key)
    }
    if (typeof $prefs !== "undefined") {
      return $prefs.setValueForKey(value, key)
    }
    return false
  }

  function readCapture() {
    try {
      const raw = readValue(STORE_KEY)
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

  function returnStatus(capture) {
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "X-ChinaBroadnet-Rewrite": "1",
    }
    const body = JSON.stringify({
      bridge: "ChinaBroadnetMonitor",
      version: 3,
      captured: Boolean(capture),
      capturedAt:
        capture && typeof capture.capturedAt === "number"
          ? capture.capturedAt
          : null,
    })
    if (typeof $task !== "undefined") {
      $done({ status: "HTTP/1.1 200 OK", headers, body })
    } else {
      $done({ response: { status: 200, headers, body } })
    }
  }

  const requestHeaders = Object.assign({}, $request.headers || {})
  const requestBody = parseBody($request.body)
  const isStatusRequest =
    headerValue(requestHeaders, STATUS_MARKER) === "1" ||
    /[?&]cbm_status=1(?:&|$)/.test(String($request.url || ""))
  const isScriptingRequest =
    headerValue(requestHeaders, SCRIPTING_MARKER) === "1"

  if (isStatusRequest) {
    returnStatus(readCapture())
    return
  }

  if (!isScriptingRequest) {
    const access = headerValue(requestHeaders, "access").trim()
    const data =
      requestBody && typeof requestBody.data === "string"
        ? requestBody.data.trim()
        : ""

    if (access && data) {
      writeValue(
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
