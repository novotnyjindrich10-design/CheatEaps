import { Component } from 'react'
import { Link } from 'react-router-dom'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('FoodGo ErrorBoundary', error, info?.componentStack)
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="page">
        <h1 className="section-title">Něco se pokazilo</h1>
        <p className="section-desc">
          Tuhle stránku se teď nepodařilo zobrazit. Zkus obnovit, nebo se vrať na úvod.
        </p>
        <div className="error-boundary-actions">
          <button type="button" className="btn btn-primary" onClick={this.handleRetry}>
            Zkusit znovu
          </button>
          <Link to="/" className="btn btn-secondary" onClick={this.handleRetry}>
            Zpět na úvod
          </Link>
        </div>
      </main>
    )
  }
}
