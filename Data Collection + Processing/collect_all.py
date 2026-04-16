from DNFlightData import main as dn_main
from NBFlightData import main as nb_main
from TSNFlightData import main as tsn_main
from weatherData import main as weather_main


if __name__ == "__main__":
    tsn_main()
    nb_main()
    dn_main()
    weather_main()
