import { Route, Switch } from "wouter";
import { HomePage, LoginPage, NotFoundPage, RegisterPage } from "./pages";

export function App() {
	return (
		<Switch>
			<Route path="/" component={HomePage} />
			<Route path="/login" component={LoginPage} />
			<Route path="/register" component={RegisterPage} />
			<Route component={NotFoundPage} />
		</Switch>
	);
}
