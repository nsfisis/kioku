import { Route, Switch } from "wouter";
import { ProtectedRoute } from "./components";
import { HomePage, LoginPage, NotFoundPage, RegisterPage } from "./pages";

export function App() {
	return (
		<Switch>
			<Route path="/">
				<ProtectedRoute>
					<HomePage />
				</ProtectedRoute>
			</Route>
			<Route path="/login" component={LoginPage} />
			<Route path="/register" component={RegisterPage} />
			<Route component={NotFoundPage} />
		</Switch>
	);
}
