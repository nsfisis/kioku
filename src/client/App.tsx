import { Route, Switch } from "wouter";
import { ProtectedRoute } from "./components";
import {
	DeckDetailPage,
	HomePage,
	LoginPage,
	NotFoundPage,
	StudyPage,
} from "./pages";

export function App() {
	return (
		<Switch>
			<Route path="/">
				<ProtectedRoute>
					<HomePage />
				</ProtectedRoute>
			</Route>
			<Route path="/decks/:deckId">
				<ProtectedRoute>
					<DeckDetailPage />
				</ProtectedRoute>
			</Route>
			<Route path="/decks/:deckId/study">
				<ProtectedRoute>
					<StudyPage />
				</ProtectedRoute>
			</Route>
			<Route path="/login" component={LoginPage} />
			<Route component={NotFoundPage} />
		</Switch>
	);
}
