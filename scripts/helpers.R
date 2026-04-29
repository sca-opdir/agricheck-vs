# This function is supposed to clean the IDs of Acontrol and possible other IDs in order to harmonize them
cleanIdentifier <- function(x) {
  
  # coerce to character
  x <- as.character(x)
  
  # map literal "+" to NA
  x <- sub("^\\+$", NA_character_, x)
  
  # extract leading digits.decimals
  #   - ^([0-9]+\.[0-9]+) captures the part you want
  #   - .* eats anything that follows
  sub("^([0-9]+\\.[0-9]+).*", "\\1", x)  
}

cleanIdentifier(c("+", "01.1.A_2021", "02.4", "2.4", "01.3_v3opt"))
