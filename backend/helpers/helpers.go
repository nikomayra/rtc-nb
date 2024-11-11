package helpers

func StringInSlice(s string, slice []string) bool {
	for _, item := range slice {
		if item == s {
			return true
		}
	}
	return false
}
