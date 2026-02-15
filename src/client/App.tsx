import { Route, Switch } from "wouter";
import { OfflineBanner, ProtectedRoute } from "./components";
import {
	DeckCardsPage,
	DeckDetailPage,
	HomePage,
	LoginPage,
	NoteTypesPage,
	NotFoundPage,
	StudyPage,
} from "./pages";

export function App() {
	return (
		<div className="min-h-screen flex flex-col">
			<OfflineBanner />
			<div className="flex-1">
				<Switch>
					<Route path="/">
						<ProtectedRoute>
							<HomePage />
						</ProtectedRoute>
					</Route>
					<Route path="/decks/:deckId/cards">
						<ProtectedRoute>
							<DeckCardsPage />
						</ProtectedRoute>
					</Route>
					<Route path="/decks/:deckId/study">
						<ProtectedRoute>
							<StudyPage />
						</ProtectedRoute>
					</Route>
					<Route path="/decks/:deckId">
						<ProtectedRoute>
							<DeckDetailPage />
						</ProtectedRoute>
					</Route>
					<Route path="/note-types">
						<ProtectedRoute>
							<NoteTypesPage />
						</ProtectedRoute>
					</Route>
					<Route path="/login" component={LoginPage} />
					<Route component={NotFoundPage} />
				</Switch>
			</div>
			<footer className="py-2 text-center text-xs text-muted">
				v{__APP_VERSION__}
			</footer>
		</div>
	);
}
