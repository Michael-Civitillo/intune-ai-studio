import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'

interface Props {
  /** POST URL (relative to origin, e.g. /api/ai/policy-explain) */
  url: string
  /** JSON body to POST */
  body: Record<string, unknown>
  /** Fires when streaming completes */
  onDone?: () => void
  /** Optional status message shown above output */
  statusMessage?: string
}

export default function AIStreamOutput({ url, body, onDone, statusMessage }: Props) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState(statusMessage || '')
  const [streaming, setStreaming] = useState(true)
  const [error, setError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function stream() {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => null)
          setError(errData?.detail || `Request failed (${res.status})`)
          setStreaming(false)
          return
        }

        const reader = res.body?.getReader()
        if (!reader) {
          setError('Streaming not supported')
          setStreaming(false)
          return
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const event = JSON.parse(line.slice(6))
              if (event.type === 'token') {
                setText(prev => prev + event.text)
              } else if (event.type === 'status') {
                setStatus(event.message)
              } else if (event.type === 'done') {
                setStreaming(false)
                onDone?.()
              } else if (event.type === 'error') {
                setError(event.message)
                setStreaming(false)
              }
            } catch {
              // ignore malformed SSE lines
            }
          }
        }
        setStreaming(false)
        onDone?.()
      } catch (e: unknown) {
        if ((e as Error).name !== 'AbortError') {
          setError((e as Error).message || 'Stream failed')
          setStreaming(false)
        }
      }
    }

    stream()
    return () => controller.abort()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll during streaming
  useEffect(() => {
    if (streaming && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [text, streaming])

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
        {error}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Status bar */}
      {(status || streaming) && (
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-2.5 bg-gray-50">
          {streaming && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-600 border-t-transparent flex-shrink-0" />
          )}
          {!streaming && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500 flex-shrink-0">
              <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          )}
          <span className="text-xs text-gray-500">
            {streaming ? (status || 'Generating...') : 'Complete'}
          </span>
        </div>
      )}

      {/* Content */}
      <div ref={containerRef} className="p-6 max-h-[600px] overflow-y-auto">
        {text ? (
          <div className="prose prose-sm prose-violet max-w-none
            prose-headings:text-gray-900 prose-p:text-gray-700
            prose-strong:text-gray-900 prose-code:text-violet-800
            prose-code:bg-violet-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
            prose-pre:bg-gray-900 prose-pre:text-gray-100
            prose-li:text-gray-700 prose-a:text-violet-700">
            <ReactMarkdown>{text}</ReactMarkdown>
          </div>
        ) : streaming ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
            Thinking...
          </div>
        ) : null}
        {streaming && text && (
          <span className="inline-block w-2 h-4 bg-violet-600 animate-pulse ml-0.5 -mb-0.5 rounded-sm" />
        )}
      </div>

      {/* Copy button */}
      {!streaming && text && (
        <div className="border-t border-gray-100 px-5 py-3 bg-gray-50 flex justify-end">
          <button
            onClick={() => navigator.clipboard.writeText(text)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy
          </button>
        </div>
      )}
    </div>
  )
}
